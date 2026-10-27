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
  ChevronDown,
  Check,
  X,
  Box,
  ExternalLink,
  Bot,
  Sparkles,
  Send,
  FolderGit2,
  Layers,
  Clock,
  ArrowUpRight,
  Cpu,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { CustomSelect } from '../components/ui/CustomSelect';
import { EmptyState, Spinner } from '../components/ui/States';

/* ──────────────────────── Types ──────────────────────── */

export interface WorkspaceRepo {
  id: string;
  name: string;
  rawName: string;
  description: string;
  source: 'myceliumops';
  fileCount: number;
  lastModified: string;
  framework?: string;
  processStatus?: string;
}

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
  workspaces: () =>
    api._request<{ workspaces: WorkspaceRepo[]; activeWorkspaceId: string | null }>(
      '/code-intelligence/workspaces'
    ),
  search: (q: string, opts?: { file?: string; language?: string; regex?: boolean; workspaceId?: string }) => {
    const p = new URLSearchParams({ q });
    if (opts?.file) p.set('file', opts.file);
    if (opts?.language) p.set('language', opts.language);
    if (opts?.regex) p.set('regex', 'true');
    if (opts?.workspaceId) p.set('workspaceId', opts.workspaceId);
    return api._request<{ query: string; count: number; results: SearchResult[] }>(
      `/code-intelligence/search?${p.toString()}`
    );
  },
  symbols: (opts?: { kind?: string; q?: string; file?: string; workspaceId?: string }) => {
    const p = new URLSearchParams();
    if (opts?.kind) p.set('kind', opts.kind);
    if (opts?.q) p.set('q', opts.q);
    if (opts?.file) p.set('file', opts.file);
    if (opts?.workspaceId) p.set('workspaceId', opts.workspaceId);
    return api._request<{ count: number; symbols: CodeSymbol[] }>(
      `/code-intelligence/symbols?${p.toString()}`
    );
  },
  graph: (workspaceId?: string) => {
    const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
    return api._request<{ nodes: GraphNode[]; edges: GraphEdge[] }>(`/code-intelligence/graph${qs}`);
  },
  stats: (workspaceId?: string) => {
    const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
    return api._request<CodebaseStats>(`/code-intelligence/stats${qs}`);
  },
  file: (path: string, workspaceId?: string) => {
    const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
    return api._request<FileContent>(`/code-intelligence/file/${path}${qs}`);
  },
  references: (symbol: string, workspaceId?: string) => {
    const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
    return api._request<{ symbol: string; count: number; imports: any[]; usages: any[] }>(
      `/code-intelligence/references/${encodeURIComponent(symbol)}${qs}`
    );
  },
  ask: (question: string, model?: string, workspaceId?: string) =>
    api._request<{ question: string; answer: string; citations: { file: string; line?: number; reason: string }[]; relatedSymbols: CodeSymbol[] }>(
      '/code-intelligence/ask',
      { method: 'POST', body: JSON.stringify({ question, model, workspaceId }) }
    ),
  reindex: (workspaceId?: string) =>
    api._request<{ message: string; stats: CodebaseStats }>(
      '/code-intelligence/reindex',
      { method: 'POST', body: JSON.stringify({ workspaceId }) }
    ),
};

/* ──────────────────────── Tabs ──────────────────────── */

const tabs: { id: TabId; label: string; icon: typeof Search }[] = [
  { id: 'search', label: 'Code Search', icon: Search },
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

const groupPalette = ['#5367FF', '#00D09C', '#06B6D4', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#10B981'];

function getGroupColor(group: string): string {
  let hash = 0;
  for (let i = 0; i < group.length; i++) {
    hash = (hash << 5) - hash + group.charCodeAt(i);
    hash |= 0;
  }
  return groupPalette[Math.abs(hash) % groupPalette.length];
}

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

function formatTimeAgo(isoString: string): string {
  try {
    const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return 'Recently';
  }
}

/* ──────────────────────── Main Component ──────────────────────── */

export function CodeIntelligence() {
  const [activeTab, setActiveTab] = useState<TabId>('search');
  const [reindexing, setReindexing] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceRepo[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-detect alignment to prevent dropdown from clipping off-screen
  useEffect(() => {
    function updateAlignment() {
      if (dropdownRef.current) {
        const rect = dropdownRef.current.getBoundingClientRect();
        const spaceOnRight = window.innerWidth - rect.left;
        const spaceOnLeft = rect.right;
        // If there is limited space on right (< 420px) but ample space on left, align to right edge
        if (spaceOnRight < 420 && spaceOnLeft > 420) {
          setAlignRight(true);
        } else {
          setAlignRight(false);
        }
      }
    }

    if (dropdownOpen) {
      updateAlignment();
      window.addEventListener('resize', updateAlignment);
      return () => window.removeEventListener('resize', updateAlignment);
    }
  }, [dropdownOpen]);

  // Fetch workspaces on mount
  const fetchWorkspaces = useCallback(async () => {
    setLoadingWorkspaces(true);
    try {
      const res = await codeIntelApi.workspaces();
      setWorkspaces(res.workspaces);
      if (res.workspaces.length > 0) {
        const saved = localStorage.getItem('nexus:active_code_intel_repo');
        const matched = saved && res.workspaces.some(w => w.id === saved);
        setSelectedWorkspaceId(matched ? saved : res.workspaces[0].id);
      } else {
        setSelectedWorkspaceId('');
      }
    } catch {
      setWorkspaces([]);
      setSelectedWorkspaceId('');
    }
    setLoadingWorkspaces(false);
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const handleSelectWorkspace = (id: string) => {
    setSelectedWorkspaceId(id);
    localStorage.setItem('nexus:active_code_intel_repo', id);
    setDropdownOpen(false);
  };

  const handleReindex = async () => {
    if (!selectedWorkspaceId) return;
    setReindexing(true);
    try {
      await codeIntelApi.reindex(selectedWorkspaceId);
      await fetchWorkspaces();
    } catch { /* ignore */ }
    setReindexing(false);
  };

  const currentWorkspace = useMemo(
    () => workspaces.find(w => w.id === selectedWorkspaceId) || workspaces[0],
    [workspaces, selectedWorkspaceId]
  );

  return (
    <div className="nexus-page space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-brand-500/10 border border-brand-500/20 text-brand-700 dark:text-brand-300">
              <Sparkles className="w-3 h-3 text-brand-500" />
              MyceliumOps Codebases Only
            </span>
          </div>
          <h1 className="text-2xl font-bold text-ink flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-xs">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            Code Intelligence
          </h1>
          <p className="text-ink-muted mt-1 text-sm">
            Code search, dependency graph, and symbol navigation for repositories created by MyceliumOps
          </p>
        </div>

        {/* ── Actions: Repo Selector & Reindex ── */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Workspace Switcher Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(prev => !prev)}
              disabled={loadingWorkspaces || workspaces.length === 0}
              className={cn(
                'flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-xs font-semibold shadow-2xs transition-all max-w-sm',
                workspaces.length === 0
                  ? 'bg-surface/50 border-line text-ink-muted cursor-not-allowed opacity-75'
                  : 'bg-surface border-line hover:border-brand-500/50 hover:bg-hover text-ink'
              )}
            >
              <div className="w-6 h-6 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0">
                <FolderGit2 className="w-3.5 h-3.5" />
              </div>
              <div className="text-left truncate">
                <div className="text-[10px] text-ink-faint font-bold uppercase tracking-wider leading-none">
                  Repository
                </div>
                <div className="font-bold text-ink truncate mt-0.5 max-w-[200px]">
                  {loadingWorkspaces ? 'Loading…' : currentWorkspace ? currentWorkspace.name : 'No Project Repos'}
                </div>
              </div>
              <ChevronDown className={cn('w-4 h-4 text-ink-muted transition-transform ml-1', dropdownOpen && 'rotate-180')} />
            </button>

            {dropdownOpen && (
              <div
                className={cn(
                  'absolute mt-2 w-80 md:w-96 max-w-[calc(100vw-2rem)] rounded-2xl bg-surface border border-line shadow-xl z-50 p-2 space-y-1 backdrop-blur-md animate-in fade-in duration-150',
                  alignRight ? 'right-0' : 'left-0'
                )}
              >
                <div className="px-3 py-2 border-b border-line-subtle mb-1">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted">
                      Project Repositories ({workspaces.length})
                    </span>
                    <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full">
                      Agent Generated
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-faint mt-1">
                    Exclusively indexing repositories engineered by project agents
                  </p>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1">
                  {workspaces.map(ws => {
                    const isSelected = ws.id === selectedWorkspaceId;
                    return (
                      <button
                        key={ws.id}
                        onClick={() => handleSelectWorkspace(ws.id)}
                        className={cn(
                          'w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition-colors text-xs group',
                          isSelected
                            ? 'bg-brand-500/10 border border-brand-500/30 text-ink'
                            : 'hover:bg-hover border border-transparent text-ink-muted hover:text-ink'
                        )}
                      >
                        <div className={cn(
                          'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 font-bold',
                          isSelected ? 'bg-brand-500 text-white' : 'bg-inset border border-line text-ink-muted group-hover:text-ink'
                        )}>
                          <FolderGit2 className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 justify-between">
                            <span className="font-bold text-ink truncate text-xs">{ws.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
                          </div>
                          {ws.description && (
                            <p className="text-[11px] text-ink-muted line-clamp-1 mt-0.5">{ws.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-ink-faint">
                            {ws.framework && (
                              <span className="px-1.5 py-0.2 rounded bg-inset border border-line font-medium text-ink-muted">
                                {ws.framework}
                              </span>
                            )}
                            <span>{ws.fileCount} files</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {formatTimeAgo(ws.lastModified)}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleReindex}
            disabled={reindexing || !selectedWorkspaceId}
            className="gap-2"
          >
            <RefreshCw className={cn('w-4 h-4', reindexing && 'animate-spin')} />
            {reindexing ? 'Indexing…' : 'Re-index'}
          </Button>
        </div>
      </div>

      {/* ── Empty State if no workspaces exist ── */}
      {workspaces.length === 0 && !loadingWorkspaces && (
        <div className="bg-surface rounded-2xl border border-line p-12 text-center max-w-2xl mx-auto shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto text-brand-600 dark:text-brand-400">
            <Box className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-ink">No Project Repositories Found</h2>
            <p className="text-sm text-ink-muted leading-relaxed max-w-lg mx-auto">
              Code Intelligence is configured to strictly index and inspect repositories engineered by your project's autonomous agents.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-inset border border-line-subtle text-xs text-ink-muted text-left space-y-1.5 max-w-md mx-auto">
            <div className="font-bold text-ink flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-brand-500" /> How repositories are generated:
            </div>
            <p>1. Go to Productions or Mission Control.</p>
            <p>2. Deploy an autonomous process (e.g. "Build full-stack auth system").</p>
            <p>3. The production agent fleet writes real code into a dedicated repository, which will automatically be indexed here.</p>
          </div>
          <div className="pt-2">
            <Link to="/processes">
              <Button variant="primary" className="gap-2">
                Deploy Production Process
                <ArrowUpRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* ── Content when workspace exists ── */}
      {workspaces.length > 0 && (
        <>
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
          {activeTab === 'search' && <SearchTab workspaceId={selectedWorkspaceId} />}
          {activeTab === 'graph' && <GraphTab workspaceId={selectedWorkspaceId} />}
          {activeTab === 'symbols' && <SymbolsTab workspaceId={selectedWorkspaceId} />}
          {activeTab === 'overview' && <OverviewTab workspaceId={selectedWorkspaceId} />}
          {activeTab === 'ask' && (
            <AskTab workspaceId={selectedWorkspaceId} workspaceName={currentWorkspace?.name} />
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TAB 1: Semantic Search
   ═══════════════════════════════════════════════════════════ */

function SearchTab({ workspaceId }: { workspaceId: string }) {
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
      const data = await codeIntelApi.search(query, {
        file: fileFilter || undefined,
        regex: isRegex,
        workspaceId,
      });
      setResults(data.results);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, [query, fileFilter, isRegex, workspaceId]);

  // Re-search when workspace changes if query present
  useEffect(() => {
    if (searched && query.trim()) {
      doSearch();
    }
  }, [workspaceId]);

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
              placeholder="Search across MyceliumOps code — e.g., Dashboard, FlowTask, handleExecute, useState"
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
            <EmptyState icon={Search} title="No results" description={`No matches found for "${query}" in this repository`} />
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
              workspaceId={workspaceId}
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

function GraphTab({ workspaceId }: { workspaceId: string }) {
  const [graph, setGraph] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    setSelectedNode(null);
    codeIntelApi.graph(workspaceId)
      .then(d => { setGraph(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [workspaceId]);

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
  if (!graph || graph.nodes.length === 0) {
    return <EmptyState icon={GitBranch} title="No dependency graph" description="No source code modules found in this MyceliumOps repository." />;
  }

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
              placeholder="Filter files in repository…"
              className="flex-1 px-3.5 py-2 bg-canvas border border-line rounded-xl text-xs font-mono text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none shadow-2xs"
            />
            <div className="text-2xs font-semibold text-ink-muted whitespace-nowrap">
              {filteredNodes.length} files · {graph.edges.length} dependencies
            </div>
          </div>

          <div className="space-y-4">
            {grouped.map(([group, nodes]) => {
              const color = getGroupColor(group);
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
                          <span className="truncate font-mono text-[11px]" title={n.id}>{name}</span>
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
            <p className="text-xs text-ink-muted">Click a file node to view its details and import dependencies</p>
          </div>
        )}

        {/* Modules breakdown */}
        <div className="bg-surface rounded-xl border border-line p-4 shadow-2xs">
          <h3 className="text-2xs text-ink-faint font-bold uppercase tracking-wider mb-3">Module Directory</h3>
          <div className="space-y-2">
            {grouped.map(([name]) => (
              <div key={name} className="flex items-center gap-2 text-xs text-ink-muted">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getGroupColor(name) }} />
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

function SymbolsTab({ workspaceId }: { workspaceId: string }) {
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
    codeIntelApi.symbols({
      kind: kindFilter || undefined,
      q: query || undefined,
      file: fileFilter || undefined,
      workspaceId,
    })
      .then(d => { setSymbols(d.symbols); setLoading(false); })
      .catch(() => setLoading(false));
  }, [query, kindFilter, fileFilter, workspaceId]);

  const handleFindRefs = async (sym: CodeSymbol) => {
    setSelectedSymbol(sym);
    setLoadingRefs(true);
    try {
      const data = await codeIntelApi.references(sym.name, workspaceId);
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
                placeholder="Search symbols in this repository…"
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
              <div className="py-8 text-center text-ink-muted text-xs">No symbols found in this repository</div>
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

function OverviewTab({ workspaceId }: { workspaceId: string }) {
  const [stats, setStats] = useState<CodebaseStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    codeIntelApi.stats(workspaceId)
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [workspaceId]);

  if (loading) return <div className="flex items-center justify-center py-16"><Spinner className="w-8 h-8" /></div>;
  if (!stats || stats.totalFiles === 0) {
    return <EmptyState icon={BarChart3} title="No codebase stats" description="No files found in this MyceliumOps repository." />;
  }

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

function FileViewer({
  path,
  highlightLine,
  onClose,
  workspaceId,
}: {
  path: string;
  highlightLine?: number;
  onClose: () => void;
  workspaceId?: string;
}) {
  const [file, setFile] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(true);
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    codeIntelApi.file(path, workspaceId)
      .then(d => { setFile(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [path, workspaceId]);

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

function AskTab({ workspaceId, workspaceName }: { workspaceId: string; workspaceName?: string }) {
  const [question, setQuestion] = useState('');
  const [chatModel, setChatModel] = useState(() => localStorage.getItem('nexus:code_intel_model') || '');
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string; provider: string }>>([]);
  useEffect(() => { api.llmProviders.availableModels().then((r) => setAvailableModels(r.models)).catch(() => {}); }, []);

  const modelOptions = useMemo(() => [
    {
      value: '',
      label: 'Auto / Configured Default',
      badge: 'Auto',
      icon: Sparkles,
    },
    ...availableModels.map((m) => {
      const providerLabel =
        m.provider === 'google' ? 'Gemini' :
        m.provider === 'opencode' ? 'OpenCode' :
        m.provider === 'local' ? 'Local' : m.provider;
      return {
        value: m.id,
        label: m.name,
        badge: providerLabel,
        icon: Cpu,
      };
    }),
  ], [availableModels]);

  const [loading, setLoading] = useState(false);
  const [fileViewer, setFileViewer] = useState<{ path: string; highlightLine?: number } | null>(null);
  const [result, setResult] = useState<{
    question: string;
    answer: string;
    citations: { file: string; line?: number; reason: string }[];
    relatedSymbols: CodeSymbol[];
  } | null>(null);

  const sampleQuestions = [
    'How is the frontend UI and Dashboard component structured?',
    'What types and interfaces are defined in this repository?',
    'Explain the API contracts and architectural specifications.',
    'Where are the main state handlers and task actions implemented?',
  ];

  const handleAsk = async (qText?: string) => {
    const q = qText || question;
    if (!q.trim()) return;
    setLoading(true);
    try {
      const data = await codeIntelApi.ask(q, chatModel || undefined, workspaceId);
      setResult(data);
      if (qText) setQuestion(qText);
    } catch (err) {
      setResult({
        question: q,
        // The real reason (an expired session, a refused model) used to be
        // replaced by "Ensure the backend server is running".
        answer: `The question couldn't be answered: ${(err as Error).message || 'request failed'}.`,
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
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-ink">Ask MyceliumOps AI Repository Assistant</h2>
            <p className="text-xs text-ink-muted">
              Grounded understanding of {workspaceName ? `"${workspaceName}"` : 'this codebase'} with file citations and symbol tracing
            </p>
            <div className="mt-3 flex items-center gap-2.5 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Model</span>
              <div className="w-64 sm:w-80">
                <CustomSelect
                  value={chatModel}
                  onChange={(val) => {
                    setChatModel(val);
                    localStorage.setItem('nexus:code_intel_model', val);
                  }}
                  options={modelOptions}
                  size="sm"
                  placeholder="Auto / configured default"
                />
              </div>
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
            placeholder={`Ask anything about this MyceliumOps codebase (e.g., 'How does Dashboard render tasks?')...`}
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
                workspaceId={workspaceId}
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
