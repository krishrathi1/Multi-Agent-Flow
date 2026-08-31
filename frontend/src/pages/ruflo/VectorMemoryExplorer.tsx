import React, { useEffect, useState } from 'react';
import {
  BrainCircuit,
  Search,
  Database,
  Download,
  Upload,
  Layers,
  Sparkles,
  RefreshCw,
  FolderTree,
  Tag,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { useRufloStore } from '../../stores/ruflo-store';

export function VectorMemoryExplorer() {
  const {
    memoryNamespaces,
    memoryRecords,
    searchResults,
    isLoadingMemory,
    fetchMemoryNamespaces,
    searchMemory,
    storeMemory,
  } = useRufloStore();

  const [query, setQuery] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('global');
  const [selectedTier, setSelectedTier] = useState<string>('semantic');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('');
  const [isStoring, setIsStoring] = useState(false);
  const [rvfNotification, setRvfNotification] = useState<string | null>(null);

  useEffect(() => {
    fetchMemoryNamespaces();
  }, [fetchMemoryNamespaces]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    await searchMemory(query, selectedNamespace === 'all' ? undefined : selectedNamespace);
  };

  const handleStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    setIsStoring(true);
    try {
      await storeMemory({
        namespace: selectedNamespace === 'all' ? 'global' : selectedNamespace,
        tier: selectedTier,
        content: newContent,
        tags: newTags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      setNewContent('');
      setNewTags('');
    } finally {
      setIsStoring(false);
    }
  };

  const handleExportRVF = async () => {
    try {
      const res = await fetch(`/api/ruflo/memory/export-rvf?namespace=${encodeURIComponent(selectedNamespace === 'all' ? 'global' : selectedNamespace)}`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agentdb-${selectedNamespace}.rvf.json`;
      a.click();
      URL.revokeObjectURL(url);
      setRvfNotification('RVF Vector Snapshot exported successfully.');
      setTimeout(() => setRvfNotification(null), 4000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-cyan-950/40 via-surface-900 to-nexus-950 p-6 rounded-2xl border border-cyan-500/20 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">AgentDB Vector Memory Explorer</h1>
            <p className="text-sm text-gray-400">
              HNSW-indexed vector search, working/episodic/semantic memory tiers, and RVF snapshots.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportRVF}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-cyan-400 text-sm border border-cyan-500/30 transition"
          >
            <Download className="w-4 h-4" />
            Export RVF
          </button>
          <button
            onClick={() => fetchMemoryNamespaces()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-gray-300 text-sm border border-surface-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingMemory ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {rvfNotification && (
        <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {rvfNotification}
        </div>
      )}

      {/* Semantic Search Bar */}
      <div className="bg-surface-900/80 border border-surface-800 rounded-2xl p-6 backdrop-blur space-y-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search across vector embeddings (e.g. 'How does authentication middleware handle tokens?')..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-nexus-600 hover:from-cyan-500 hover:to-nexus-500 text-white font-medium text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20"
          >
            <Sparkles className="w-4 h-4" />
            Vector Search
          </button>
        </form>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="pt-4 border-t border-surface-800 space-y-3">
            <h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Semantic Matches ({searchResults.length})
            </h3>
            <div className="space-y-2.5">
              {searchResults.map((res) => (
                <div
                  key={res.record.id}
                  className="p-4 rounded-xl bg-surface-800/90 border border-cyan-500/20 hover:border-cyan-500/40 transition space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-cyan-300">
                      Rank #{res.rank} · Similarity: {(res.similarity * 100).toFixed(1)}%
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-900 text-gray-400 border border-surface-700 capitalize">
                      {res.record.tier} Tier
                    </span>
                  </div>
                  <p className="text-sm text-gray-200">{res.record.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Namespaces & Tiers Navigator */}
        <div className="space-y-6">
          <div className="bg-surface-900/80 border border-surface-800 rounded-2xl p-6 backdrop-blur space-y-4">
            <h3 className="text-md font-semibold text-white flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-cyan-400" />
              Namespaces & Clusters
            </h3>
            <div className="space-y-2">
              {memoryNamespaces.map((ns) => (
                <button
                  key={ns.namespace}
                  onClick={() => setSelectedNamespace(ns.namespace)}
                  className={`w-full p-3 rounded-xl border text-left transition flex items-center justify-between ${
                    selectedNamespace === ns.namespace
                      ? 'bg-cyan-500/15 border-cyan-500/40 text-white'
                      : 'bg-surface-800/60 border-surface-700 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span className="font-semibold text-sm capitalize">{ns.namespace}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface-900 border border-surface-700 text-gray-300 font-mono">
                    {ns.count} docs
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Store Vector Knowledge */}
          <div className="bg-surface-900/80 border border-surface-800 rounded-2xl p-6 backdrop-blur space-y-4">
            <h3 className="text-md font-semibold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              Store Vector Embedding
            </h3>
            <form onSubmit={handleStore} className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Target Tier</label>
                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
                >
                  <option value="semantic">Semantic (Facts & Architecture)</option>
                  <option value="episodic">Episodic (Task History & Runs)</option>
                  <option value="working">Working (Active Session Scratchpad)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Knowledge Content</label>
                <textarea
                  rows={3}
                  placeholder="Enter markdown or textual knowledge..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. auth, security, jwt"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                type="submit"
                disabled={isStoring || !newContent.trim()}
                className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium py-2 rounded-xl text-xs transition shadow-lg shadow-cyan-600/20"
              >
                {isStoring ? 'Embedding & Indexing...' : 'Index in AgentDB'}
              </button>
            </form>
          </div>
        </div>

        {/* Knowledge Records Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-surface-900/80 border border-surface-800 rounded-2xl p-6 backdrop-blur space-y-4">
            <h3 className="text-md font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Indexed Memory Records ({memoryRecords.length})
            </h3>

            <div className="space-y-3">
              {memoryRecords.map((record) => (
                <div
                  key={record.id}
                  className="p-4 rounded-xl bg-surface-800/80 border border-surface-700/80 hover:border-cyan-500/30 transition space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-cyan-400">{record.namespace}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-900 text-gray-400 border border-surface-700 uppercase">
                        {record.tier}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(record.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-sm text-gray-200">{record.content}</p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {record.tags.map((t) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-surface-900 text-gray-400 border border-surface-700">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
