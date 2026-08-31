import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Network,
  RefreshCw,
  Share2,
  Activity,
  Zap,
  Radio,
  MessageSquare,
  Bot,
  Layers,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn, timeAgo } from '@/lib/utils';
import { agentStatusLabel, agentStatusTone, tones } from '@/lib/design';
import { useChartTheme } from '@/lib/use-chart-theme';
import { useProcessStore } from '@/stores/process-store';
import { ProcessScope } from '@/components/process/ProcessScope';
import { ForceGraph, type GraphEdge, type GraphNode } from '@/components/topology/ForceGraph';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge, Chip } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/States';
import { HourglassLoader } from '@/components/ui/HourglassLoader';
import { LiveWaveform } from '@/components/ui/LiveIcon';

interface GraphNodeApi {
  id: string;
  name: string;
  displayName: string;
  avatar: string | null;
  status: string;
  processId?: string | null;
  processRole?: string | null;
  processStage?: number | null;
}

interface GraphEdgeApi {
  source: string;
  target: string;
  messageCount: number;
  lastMessage: string;
}

export function Topology() {
  const [nodes, setNodes] = useState<GraphNodeApi[]>([]);
  const [edges, setEdges] = useState<GraphEdgeApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const chart = useChartTheme();
  const { scopeId, setScope, processes } = useProcessStore();
  const [searchParams] = useSearchParams();

  const linked = searchParams.get('processId');
  useEffect(() => {
    if (linked && linked !== scopeId) setScope(linked);
  }, [linked, scopeId, setScope]);

  const load = useMemo(
    () => async () => {
      setLoading(true);
      try {
        const graph = await api.threads.graph(scopeId || undefined);
        setNodes(graph.nodes as GraphNodeApi[]);
        setEdges(graph.edges as GraphEdgeApi[]);
      } catch (err) {
        console.error('Failed to load topology:', err);
      } finally {
        setLoading(false);
      }
    },
    [scopeId],
  );

  useEffect(() => {
    load();
  }, [load]);

  const activeProcess = processes.find((p) => p.id === scopeId) ?? null;

  const graphNodes: GraphNode[] = useMemo(() => {
    const outbound = new Map<string, number>();
    for (const e of edges) {
      outbound.set(e.source, (outbound.get(e.source) ?? 0) + e.messageCount);
      outbound.set(e.target, (outbound.get(e.target) ?? 0) + e.messageCount);
    }

    return nodes.map((n, i) => ({
      id: n.id,
      label: n.displayName,
      sublabel: n.processRole ?? undefined,
      color:
        activeProcess && n.processStage != null
          ? chart.colors[(n.processStage - 1) % chart.colors.length]
          : chart.colors[i % chart.colors.length],
      weight: outbound.get(n.id) ?? 1,
      status: n.status,
      stage: n.processStage ?? null,
      avatar: n.avatar,
    }));
  }, [nodes, edges, chart.colors, activeProcess]);

  const graphEdges: GraphEdge[] = useMemo(
    () =>
      edges.map((e) => ({
        source: e.source,
        target: e.target,
        weight: e.messageCount,
        label: `${e.messageCount} msg`,
      })),
    [edges],
  );

  const selectedNode = nodes.find((n) => n.id === selected) ?? null;
  const selectedEdges = edges.filter(
    (e) => e.source === selected || e.target === selected,
  );

  const totalMessages = edges.reduce((n, e) => n + e.messageCount, 0);
  const maxLinkWeight = Math.max(1, ...edges.map((e) => e.messageCount));

  const [viewTab, setViewTab] = useState<'graph' | 'list'>('graph');

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Network}
        title="Network Graph"
        description="Visual interaction topology and real-time communication mesh between active agents"
        badge={
          activeProcess ? (
            <Badge tone="brand" icon={Share2}>
              {activeProcess.name}
            </Badge>
          ) : undefined
        }
        actions={
          <div className="flex items-center gap-2.5">
            <ProcessScope align="right" />
            <Button variant="secondary" icon={RefreshCw} onClick={load} loading={loading}>
              Refresh
            </Button>
          </div>
        }
      />

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="rounded-2xl border border-line-subtle bg-surface p-4.5 shadow-2xs hover:border-line-strong hover:shadow-xs transition-all">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Active Agents</span>
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 flex items-center justify-center">
              <Bot size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-ink tracking-tight font-mono">
            {nodes.length}
          </div>
          <p className="text-[11px] text-ink-muted mt-1 font-medium">Nodes in communication mesh</p>
        </div>

        <div className="rounded-2xl border border-line-subtle bg-surface p-4.5 shadow-2xs hover:border-line-strong hover:shadow-xs transition-all">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Active Channels</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <Radio size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-ink tracking-tight font-mono text-emerald-600 dark:text-emerald-400">
            {edges.length}
          </div>
          <p className="text-[11px] text-ink-muted mt-1 font-medium">Directed message pipelines</p>
        </div>

        <div className="rounded-2xl border border-line-subtle bg-surface p-4.5 shadow-2xs hover:border-line-strong hover:shadow-xs transition-all">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Total Messages</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center">
              <MessageSquare size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-ink tracking-tight font-mono">
            {totalMessages}
          </div>
          <p className="text-[11px] text-ink-muted mt-1 font-medium">Payloads exchanged</p>
        </div>

        <div className="rounded-2xl border border-line-subtle bg-surface p-4.5 shadow-2xs hover:border-line-strong hover:shadow-xs transition-all">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Mesh Density</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <Network size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-ink tracking-tight font-mono">
            {nodes.length > 1
              ? `${Math.round((edges.length / (nodes.length * (nodes.length - 1))) * 100)}%`
              : '100%'}
          </div>
          <p className="text-[11px] text-ink-muted mt-1 font-medium">Inter-connectivity score</p>
        </div>
      </div>

      {/* Mobile View Selector */}
      <div className="flex sm:hidden gap-1.5 bg-surface rounded-xl p-1 border border-line w-fit shadow-2xs">
        <button
          type="button"
          onClick={() => setViewTab('graph')}
          className={cn(
            'px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer',
            viewTab === 'graph'
              ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 shadow-2xs border border-brand-500/20'
              : 'text-ink-muted hover:text-ink'
          )}
        >
          Graph View
        </button>
        <button
          type="button"
          onClick={() => setViewTab('list')}
          className={cn(
            'px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer',
            viewTab === 'list'
              ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 shadow-2xs border border-brand-500/20'
              : 'text-ink-muted hover:text-ink'
          )}
        >
          Links ({edges.length})
        </button>
      </div>

      {/* Main Grid: Graph + Inspector */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Main Interactive Graph Card */}
        <div
          className={cn(
            'rounded-2xl border border-line-subtle bg-surface shadow-xs overflow-hidden flex flex-col',
            viewTab === 'list' && 'hidden sm:flex'
          )}
        >
          <div className="flex items-center justify-between p-4 border-b border-line-subtle">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <Network size={15} />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                  Communication Mesh
                </h3>
                <p className="text-[11px] text-ink-muted font-medium">
                  {nodes.length} agents · {edges.length} channels · {totalMessages} messages
                </p>
              </div>
            </div>
            <LiveWaveform color="bg-brand-500" />
          </div>

          <div className="relative flex-1 min-h-[400px] sm:min-h-[540px] lg:min-h-[620px] bg-grid overflow-hidden">
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <HourglassLoader size={48} label="Building topology graph..." />
              </div>
            ) : nodes.length === 0 ? (
              <div className="absolute inset-0 grid place-items-center p-6">
                <EmptyState
                  icon={Network}
                  title="No Agent Communication Yet"
                  description={
                    activeProcess
                      ? `Agents in "${activeProcess.name}" have not transmitted inter-agent messages yet.`
                      : 'Trigger a multi-agent process to visualize live communication links.'
                  }
                />
              </div>
            ) : (
              <ForceGraph
                nodes={graphNodes}
                edges={graphEdges}
                selectedId={selected}
                onSelect={setSelected}
              />
            )}

            {/* Hint pill */}
            <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-surface/90 backdrop-blur-md border border-line text-[10px] font-semibold text-ink-muted shadow-2xs pointer-events-none">
              💡 Drag to pan · Scroll to zoom · Click node to inspect
            </div>
          </div>
        </div>

        {/* Mobile Connections List */}
        {viewTab === 'list' && (
          <div className="block sm:hidden space-y-3">
            <div className="rounded-2xl border border-line-subtle bg-surface p-4 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink mb-3">
                Active Channels ({edges.length})
              </h3>
              <ul className="divide-y divide-line-subtle">
                {edges.map((e, i) => {
                  const s = nodes.find((n) => n.id === e.source);
                  const t = nodes.find((n) => n.id === e.target);
                  return (
                    <li key={`${e.source}-${e.target}-${i}`} className="py-3 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-ink truncate">
                          <span>{s?.displayName ?? 'Unknown'}</span>
                          <span className="text-brand-500 font-mono">→</span>
                          <span>{t?.displayName ?? 'Unknown'}</span>
                        </div>
                        {e.lastMessage && (
                          <p className="text-[11px] text-ink-muted truncate font-mono">
                            {e.lastMessage}
                          </p>
                        )}
                      </div>
                      <Chip>{e.messageCount} msgs</Chip>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {/* Right Inspector & Leaderboard */}
        <div className="space-y-4">
          {/* Selected Node Inspector */}
          {selectedNode ? (
            <div className="rounded-2xl border border-line-subtle bg-surface p-5 shadow-xs animate-scale-in">
              <div className="flex items-center justify-between pb-3.5 border-b border-line-subtle mb-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                    Agent Inspector
                  </h4>
                  <p className="text-[11px] text-ink-muted font-mono">
                    {selectedNode.processRole ?? selectedNode.name}
                  </p>
                </div>
                <Link
                  to={`/agents/${selectedNode.id}`}
                  className="flex items-center gap-1 text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
                >
                  Profile
                  <ArrowUpRight size={13} />
                </Link>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 bg-inset/50 p-3 rounded-xl border border-line-subtle">
                  <Avatar
                    name={selectedNode.displayName}
                    emoji={selectedNode.avatar}
                    size="md"
                    status={agentStatusTone[selectedNode.status as keyof typeof agentStatusTone]}
                    statusLabel={agentStatusLabel[selectedNode.status as keyof typeof agentStatusLabel]}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-ink truncate">{selectedNode.displayName}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge
                        tone={agentStatusTone[selectedNode.status as keyof typeof agentStatusTone]}
                        dot
                      >
                        {agentStatusLabel[selectedNode.status as keyof typeof agentStatusLabel]}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-2.5">
                    Active Connections ({selectedEdges.length})
                  </p>
                  <ul className="space-y-2 max-h-48 overflow-y-auto pr-1 no-scrollbar">
                    {selectedEdges.map((e, i) => {
                      const otherId = e.source === selected ? e.target : e.source;
                      const other = nodes.find((n) => n.id === otherId);
                      const outgoing = e.source === selected;
                      return (
                        <li
                          key={`${e.source}-${e.target}-${i}`}
                          className="flex items-center justify-between gap-2 rounded-xl bg-inset p-2.5 text-xs border border-line-subtle"
                        >
                          <div className="flex items-center gap-2 min-w-0 truncate">
                            <span
                              className={cn(
                                'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded font-mono',
                                outgoing
                                  ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20'
                                  : 'bg-surface text-ink-muted border border-line',
                              )}
                            >
                              {outgoing ? 'OUT' : 'IN'}
                            </span>
                            <span className="truncate font-bold text-ink text-xs">
                              {other?.displayName ?? 'Unknown'}
                            </span>
                          </div>
                          <span className="font-mono text-2xs font-bold text-ink-muted shrink-0">
                            {e.messageCount} msg
                          </span>
                        </li>
                      );
                    })}
                    {selectedEdges.length === 0 && (
                      <li className="text-xs text-ink-muted p-3 text-center bg-inset rounded-xl">
                        No active channels for this agent.
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-line-subtle bg-surface p-6 text-center shadow-xs">
              <Share2 size={28} className="mx-auto mb-2 text-ink-faint opacity-50" />
              <h4 className="text-xs font-bold text-ink">Select an Agent</h4>
              <p className="text-xs text-ink-muted mt-1">
                Click any glowing node in the graph to inspect its communication links and message history.
              </p>
            </div>
          )}

          {/* Busiest Channels Ranked Leaderboard */}
          <div className="rounded-2xl border border-line-subtle bg-surface p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3.5 border-b border-line-subtle mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                Busiest Channels
              </h4>
              <span className="text-[10px] font-mono font-bold text-ink-muted uppercase">
                Ranked
              </span>
            </div>

            <ul className="space-y-3">
              {[...edges]
                .sort((a, b) => b.messageCount - a.messageCount)
                .slice(0, 5)
                .map((e, i) => {
                  const s = nodes.find((n) => n.id === e.source);
                  const t = nodes.find((n) => n.id === e.target);
                  const pct = Math.round((e.messageCount / maxLinkWeight) * 100);
                  return (
                    <li key={`${e.source}-${e.target}-${i}`} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold gap-2">
                        <span className="truncate text-ink">
                          {s?.displayName ?? '—'}{' '}
                          <span className="text-brand-500 font-mono">→</span>{' '}
                          {t?.displayName ?? '—'}
                        </span>
                        <span className="font-mono text-2xs text-brand-600 dark:text-brand-400 shrink-0">
                          {e.messageCount} msgs
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-inset overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              {edges.length === 0 && (
                <li className="py-6 text-center text-xs text-ink-muted">
                  No inter-agent communication channels active.
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

