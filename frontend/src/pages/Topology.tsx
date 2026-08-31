import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Network, RefreshCw, Share2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, timeAgo } from '@/lib/utils';
import { agentStatusLabel, agentStatusTone, tones } from '@/lib/design';
import { useChartTheme } from '@/lib/use-chart-theme';
import { useProcessStore } from '@/stores/process-store';
import { ProcessScope } from '@/components/process/ProcessScope';
import { ForceGraph, type GraphEdge, type GraphNode } from '@/components/topology/ForceGraph';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, Chip } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState, Spinner } from '@/components/ui/States';

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

  /* Colour by pipeline stage when scoped to one production (the stage is the
     meaningful grouping there); otherwise give each agent a stable hue. */
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

  const [viewTab, setViewTab] = useState<'graph' | 'list'>('graph');

  return (
    <>
      <PageHeader
        icon={Network}
        title="Network Graph"
        description="Who talks to whom, and how often."
        badge={
          activeProcess ? (
            <Badge tone="brand" icon={Share2}>
              {activeProcess.name}
            </Badge>
          ) : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            <ProcessScope align="right" />
            <Button variant="secondary" icon={RefreshCw} onClick={load} loading={loading}>
              Refresh
            </Button>
          </div>
        }
      />

      {/* ── Mobile View Selector Pills ── */}
      <div className="flex sm:hidden gap-1 bg-inset/50 rounded-xl p-1 border border-line w-fit shadow-2xs mb-4">
        <button
          type="button"
          onClick={() => setViewTab('graph')}
          className={cn(
            'px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer',
            viewTab === 'graph'
              ? 'bg-surface text-brand-600 dark:text-brand-400 shadow-2xs border border-line-subtle'
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
              ? 'bg-surface text-brand-600 dark:text-brand-400 shadow-2xs border border-line-subtle'
              : 'text-ink-muted hover:text-ink'
          )}
        >
          Connections List ({edges.length})
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main Graph Card */}
        <Card padding="none" className={cn('overflow-hidden', viewTab === 'list' && 'hidden sm:block')}>
          <CardHeader
            bordered
            icon={Network}
            title="Communication topology"
            description={`${nodes.length} agents · ${edges.length} links · ${totalMessages} messages`}
          />
          <div className="relative h-[360px] sm:h-[480px] lg:h-[580px] bg-grid">
            {loading ? (
              <div className="absolute inset-0 grid place-items-center">
                <Spinner size={22} />
              </div>
            ) : nodes.length === 0 ? (
              <div className="absolute inset-0 grid place-items-center">
                <EmptyState
                  icon={Network}
                  title="No agent communication yet"
                  description={
                    activeProcess
                      ? `Agents in "${activeProcess.name}" haven't messaged each other yet.`
                      : 'Once agents start messaging each other, the network appears here.'
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

            {/* Mobile tap hint pill */}
            <div className="absolute bottom-2.5 left-2.5 sm:hidden px-2.5 py-1 rounded-full bg-surface/90 border border-line text-[10px] font-semibold text-ink-muted backdrop-blur-xs shadow-2xs">
              Tap any node to inspect connections
            </div>
          </div>
        </Card>

        {/* Mobile Connections Roster (Visible when Tab is list on phone) */}
        {viewTab === 'list' && (
          <div className="block sm:hidden space-y-3">
            <Card padding="none">
              <CardHeader
                bordered
                icon={Network}
                title="Active Communication Links"
                description={`${edges.length} connections in total`}
              />
              <ul className="divide-y divide-line-subtle">
                {edges.map((e, i) => {
                  const s = nodes.find((n) => n.id === e.source);
                  const t = nodes.find((n) => n.id === e.target);
                  return (
                    <li key={`${e.source}-${e.target}-${i}`} className="p-3 flex items-center justify-between gap-2">
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
                {edges.length === 0 && (
                  <li className="p-8 text-center text-xs text-ink-muted">
                    No communication links recorded.
                  </li>
                )}
              </ul>
            </Card>
          </div>
        )}

        {/* ---- Inspector ---- */}
        <div className="space-y-4">
          {selectedNode ? (
            <Card padding="none">
              <CardHeader
                bordered
                title={selectedNode.displayName}
                description={selectedNode.processRole ?? selectedNode.name}
                actions={
                  <Link
                    to={`/agents/${selectedNode.id}`}
                    className="flex items-center gap-1 text-xs font-medium text-ink-subtle transition-colors hover:text-brand-700 dark:hover:text-brand-300"
                  >
                    Open
                    <ArrowUpRight size={12} strokeWidth={2} aria-hidden />
                  </Link>
                }
              />
              <div className="space-y-3 p-4">
                <div className="flex items-center gap-2.5">
                  <Avatar
                    name={selectedNode.displayName}
                    emoji={selectedNode.avatar}
                    size="md"
                    status={agentStatusTone[selectedNode.status as keyof typeof agentStatusTone]}
                    statusLabel={agentStatusLabel[selectedNode.status as keyof typeof agentStatusLabel]}
                  />
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-ink-faint">{selectedNode.name}</p>
                    <Badge
                      tone={agentStatusTone[selectedNode.status as keyof typeof agentStatusTone]}
                      dot
                    >
                      {agentStatusLabel[selectedNode.status as keyof typeof agentStatusLabel]}
                    </Badge>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint">
                    Connections
                  </p>
                  <ul className="space-y-1.5">
                    {selectedEdges.map((e, i) => {
                      const otherId = e.source === selected ? e.target : e.source;
                      const other = nodes.find((n) => n.id === otherId);
                      const outgoing = e.source === selected;
                      return (
                        <li
                          key={`${e.source}-${e.target}-${i}`}
                          className="flex items-center gap-2 rounded-xl bg-inset px-3 py-2 text-xs border border-line-subtle"
                        >
                          <span
                            className={cn(
                              'text-2xs font-bold uppercase tracking-wider',
                              outgoing
                                ? 'text-brand-600 dark:text-brand-400'
                                : 'text-ink-faint',
                            )}
                          >
                            {outgoing ? 'to' : 'from'}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                            {other?.displayName ?? 'Unknown'}
                          </span>
                          <Chip>{e.messageCount} msgs</Chip>
                        </li>
                      );
                    })}
                    {selectedEdges.length === 0 && (
                      <li className="text-xs text-ink-faint">No connections yet.</li>
                    )}
                  </ul>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <EmptyState
                compact
                icon={Share2}
                title="Select an agent"
                description="Click any node in the graph to inspect its live connections and message exchange."
              />
            </Card>
          )}

          {/* ---- Busiest links ---- */}
          <Card padding="none">
            <CardHeader bordered title="Busiest links" description="By message volume" />
            <ul className="p-2 divide-y divide-line-subtle sm:divide-y-0">
              {[...edges]
                .sort((a, b) => b.messageCount - a.messageCount)
                .slice(0, 6)
                .map((e, i) => {
                  const s = nodes.find((n) => n.id === e.source);
                  const t = nodes.find((n) => n.id === e.target);
                  return (
                    <li
                      key={`${e.source}-${e.target}-${i}`}
                      className="flex items-center gap-2 rounded-xl p-2.5 transition-colors hover:bg-hover"
                    >
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">
                        {s?.displayName ?? '—'} <span className="text-brand-500 font-bold">→</span> {t?.displayName ?? '—'}
                      </span>
                      <Chip>{e.messageCount} msgs</Chip>
                    </li>
                  );
                })}
              {edges.length === 0 && (
                <li className="px-2 py-4 text-center text-xs text-ink-faint">
                  No links recorded.
                </li>
              )}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
