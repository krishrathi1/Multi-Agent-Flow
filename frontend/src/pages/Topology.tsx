import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
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
  GitFork,
  ArrowRight,
  SlidersHorizontal,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn, timeAgo } from '@/lib/utils';
import { agentStatusTone } from '@/lib/design';
import { useChartTheme } from '@/lib/use-chart-theme';
import { useProcessStore } from '@/stores/process-store';
import { ProcessScope } from '@/components/process/ProcessScope';
import { ForceGraph, type GraphEdge, type GraphNode } from '@/components/topology/ForceGraph';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { HourglassLoader } from '@/components/ui/HourglassLoader';
import { AgentDetailSheet } from '@/components/agent/AgentDetailSheet';
import type { Agent } from '@/types';

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
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedAgentObj, setSelectedAgentObj] = useState<Agent | null>(null);
  const [viewMode, setViewMode] = useState<'graph' | 'flow'>('graph');

  const chart = useChartTheme();
  const { scopeId, setScope, processes } = useProcessStore();
  const [searchParams] = useSearchParams();

  const linked = searchParams.get('processId');
  useEffect(() => {
    if (linked && linked !== scopeId) setScope(linked);
  }, [linked, scopeId, setScope]);

  const loadData = useMemo(
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
    [scopeId]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    [edges]
  );

  // Sorted stages for Mobile Flow Mode
  const flowStages = useMemo(() => {
    const stageMap = new Map<number, GraphNodeApi[]>();
    const unassigned: GraphNodeApi[] = [];

    for (const n of nodes) {
      if (n.processStage != null) {
        const list = stageMap.get(n.processStage) || [];
        list.push(n);
        stageMap.set(n.processStage, list);
      } else {
        unassigned.push(n);
      }
    }

    const sortedStages = Array.from(stageMap.entries()).sort(([a], [b]) => a - b);
    return { stages: sortedStages, unassigned };
  }, [nodes]);

  const totalMessages = edges.reduce((n, e) => n + e.messageCount, 0);

  const handleNodeClick = async (nodeId: string) => {
    setSelectedAgentId(nodeId);
    try {
      const agent = await api.agents.get(nodeId);
      setSelectedAgentObj(agent);
    } catch {
      const fallback = nodes.find((n) => n.id === nodeId);
      if (fallback) {
        setSelectedAgentObj({
          id: fallback.id,
          name: fallback.name,
          displayName: fallback.displayName,
          avatar: fallback.avatar,
          status: fallback.status as any,
          processRole: fallback.processRole,
          processStage: fallback.processStage,
          enabled: true,
          heartbeatInterval: 5,
          lastHeartbeat: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          description: '',
          workspace: '',
          currentTask: null,
          gatewayId: null,
          gatewayAgentId: null,
          boardId: null,
          isBoardLead: false,
          agentToAgent: true,
          soulTemplateId: null,
          soulMd: null,
          processId: fallback.processId ?? null,
        } as Agent);
      }
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 flex items-center justify-center shrink-0">
            <Network size={17} />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-ink tracking-tight flex items-center gap-2">
              Network Topology
              {activeProcess && (
                <Badge tone="brand" size="sm">
                  {activeProcess.name}
                </Badge>
              )}
            </h1>
            <p className="text-2xs text-ink-muted">Inter-agent communication mesh and execution pipelines</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <ProcessScope align="right" />
          <Button variant="secondary" size="xs" icon={RefreshCw} loading={loading} onClick={loadData}>
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
        <div className="p-3 sm:p-4 rounded-2xl border border-line-subtle bg-surface shadow-2xs space-y-1">
          <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted block">Network Nodes</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-ink">{nodes.length}</div>
          <span className="text-[10px] text-ink-faint font-mono block">Active agents</span>
        </div>

        <div className="p-3 sm:p-4 rounded-2xl border border-line-subtle bg-surface shadow-2xs space-y-1">
          <span className="text-2xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">Links / Edges</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{edges.length}</div>
          <span className="text-[10px] text-ink-faint font-mono block">Peer routes</span>
        </div>

        <div className="p-3 sm:p-4 rounded-2xl border border-line-subtle bg-surface shadow-2xs space-y-1">
          <span className="text-2xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">Messages</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-purple-600 dark:text-purple-400">{totalMessages}</div>
          <span className="text-[10px] text-ink-faint font-mono block">Dispatched</span>
        </div>
      </div>

      {/* View Switcher Chips: Graph View | Flow View */}
      <div className="flex items-center gap-1.5 border-b border-line-subtle pb-2">
        <button
          type="button"
          onClick={() => setViewMode('graph')}
          className={cn(
            'px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shadow-2xs flex items-center gap-1.5',
            viewMode === 'graph'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'border border-line bg-surface text-ink-muted hover:text-ink hover:bg-hover'
          )}
        >
          <Network size={13} />
          <span>Interactive Graph</span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode('flow')}
          className={cn(
            'px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shadow-2xs flex items-center gap-1.5',
            viewMode === 'flow'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'border border-line bg-surface text-ink-muted hover:text-ink hover:bg-hover'
          )}
        >
          <GitFork size={13} />
          <span>Mobile Flow View</span>
        </button>
      </div>

      {/* VIEW A: INTERACTIVE FORCE GRAPH */}
      {viewMode === 'graph' && (
        <div className="rounded-3xl border border-line-subtle bg-surface p-3 sm:p-5 shadow-xs relative overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <HourglassLoader size={48} label="Calculating node coordinates..." />
            </div>
          ) : nodes.length === 0 ? (
            <div className="py-20 text-center text-xs text-ink-muted bg-inset/40 rounded-2xl border border-dashed border-line">
              <Network size={32} className="mx-auto mb-2 text-ink-faint opacity-50" />
              <p className="font-bold text-ink mb-1">No Network Topology Found</p>
              <p className="text-2xs text-ink-muted">Run a production pipeline to create agent communication links.</p>
            </div>
          ) : (
            <div className="w-full h-[400px] sm:h-[480px]">
              <ForceGraph
                nodes={graphNodes}
                edges={graphEdges}
                selectedId={selectedAgentId}
                onSelect={(id) => id && handleNodeClick(id)}
              />
            </div>
          )}
        </div>
      )}

      {/* VIEW B: MOBILE FLOW VIEW */}
      {viewMode === 'flow' && (
        <div className="space-y-4">
          {nodes.length === 0 ? (
            <div className="py-16 text-center text-xs text-ink-muted bg-surface rounded-2xl border border-line-subtle p-6">
              No agents mapped to execution stages yet.
            </div>
          ) : (
            <div className="space-y-3">
              {flowStages.stages.map(([stageNum, stageNodes], sIdx) => (
                <div key={stageNum} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="w-6 h-6 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs font-bold font-mono flex items-center justify-center">
                      {stageNum}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-ink">
                      Execution Stage {stageNum}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {stageNodes.map((node) => {
                      const tone = (agentStatusTone as any)[node.status] || 'neutral';
                      return (
                        <div
                          key={node.id}
                          onClick={() => handleNodeClick(node.id)}
                          className="w-full rounded-2xl border border-line-subtle bg-surface p-3.5 shadow-2xs hover:border-line hover:bg-hover/40 transition-all flex items-center justify-between gap-3 text-left cursor-pointer active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-600 flex items-center justify-center text-sm shrink-0">
                              {node.avatar || '🤖'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs sm:text-sm font-bold text-ink truncate">{node.displayName}</span>
                                <Badge tone={tone} size="sm">
                                  {node.status.toLowerCase()}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-ink-muted font-mono truncate mt-0.5">
                                {node.processRole || 'Autonomous Agent'}
                              </p>
                            </div>
                          </div>

                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNodeClick(node.id);
                            }}
                          >
                            Details
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  {sIdx < flowStages.stages.length - 1 && (
                    <div className="flex justify-center py-1 text-ink-muted opacity-40">
                      <ArrowRight size={16} className="rotate-90" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Agent Detail Sheet on node selection */}
      <AgentDetailSheet
        agent={selectedAgentObj}
        onClose={() => {
          setSelectedAgentId(null);
          setSelectedAgentObj(null);
        }}
        onCommandSent={loadData}
      />
    </div>
  );
}
